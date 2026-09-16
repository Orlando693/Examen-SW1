import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import Handlebars from 'handlebars';
import type { RelationalColumn, RelationalModel, RelationalRelation, RelationalTable } from '@examen-sw1/relational-core';
import type { GeneratedFile, SpringGenerationResponse, SpringGeneratorDiagnostic, SpringGeneratorOptions } from './types.js';

const DEFAULT_PACKAGE = 'com.generated.app';
const templatesRoot = new URL('../templates/', import.meta.url);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const diagnostic = (code: string, message: string, path: string): SpringGeneratorDiagnostic => ({ severity: 'ERROR', code, message, path });
const camel = (value: string) => value.replace(/_+([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase());
const pascal = (value: string) => camel(value).replace(/^[a-z]/, (character) => character.toUpperCase());
const javaPath = (basePackage: string) => basePackage.replaceAll('.', '/');
const packageIsSafe = (value: string) => /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value) && !value.startsWith('java.') && !value.startsWith('jakarta.');

Handlebars.registerHelper('eq', (left: unknown, right: unknown) => left === right);

interface TemplateContext { [key: string]: unknown; }
interface EntityContext extends TemplateContext {
  packageName: string;
  className: string;
  tableName: string;
  root: boolean;
  parentClassName?: string;
  id: FieldContext;
  fields: FieldContext[];
  createFields: FieldContext[];
  updateFields: FieldContext[];
  relationships: RelationshipContext[];
}
interface FieldContext extends TemplateContext {
  name: string;
  columnName: string;
  javaType: string;
  sqlType: string;
  nullable: boolean;
  generated: boolean;
  id: boolean;
  enumType?: string;
  validation: string[];
}
interface RelationshipContext extends TemplateContext { name: string; annotation: string; targetClassName: string; joinColumn: string; cascade: boolean; }

async function render(name: string, context: TemplateContext): Promise<string> {
  const source = await readFile(new URL(`${name}.hbs`, templatesRoot), 'utf8');
  return Handlebars.compile(source, { noEscape: true, preventIndent: true })(context).trimEnd() + '\n';
}

function tableColumns(table: RelationalTable, model: RelationalModel): FieldContext[] {
  const enumNames = new Map(model.enums.map((item) => [item.id, pascal(item.name)]));
  const foreignColumnIds = new Set(table.foreignKeys.flatMap((foreignKey) => foreignKey.columnIds).filter((id) => !table.primaryKey.columnIds.includes(id)));
  return table.columns.filter((column) => !foreignColumnIds.has(column.id)).map((column) => field(column, table.primaryKey.columnIds.includes(column.id), enumNames));
}

function field(column: RelationalColumn, id: boolean, enumNames: Map<string, string>): FieldContext {
  const isString = column.javaType === 'String' && !column.enumId;
  return {
    name: camel(column.name), columnName: column.name, javaType: column.javaType, sqlType: column.sqlType,
    nullable: column.nullable, generated: column.generated, id, enumType: column.enumId ? enumNames.get(column.enumId) : undefined,
    validation: [...(!column.nullable ? ['NotNull'] : []), ...(isString ? ['Size'] : [])],
  };
}

function entityContext(table: RelationalTable, model: RelationalModel, basePackage: string): EntityContext {
  const entityTables = model.tables.filter((item) => item.kind === 'ENTITY');
  const parent = model.relations.find((item) => item.kind === 'INHERITANCE' && item.ownerTableId === table.id);
  const child = model.relations.some((item) => item.kind === 'INHERITANCE' && item.tableIds[1] === table.id);
  const relationships = table.foreignKeys.flatMap((foreignKey) => {
    const target = entityTables.find((item) => item.id === foreignKey.referencedTableId);
    const relation = model.relations.find((item) => item.ownerTableId === table.id && item.tableIds.includes(foreignKey.referencedTableId));
    const column = table.columns.find((item) => item.id === foreignKey.columnIds[0]);
    if (!target || !column) throw new Error(`Invalid relational foreign key ${foreignKey.id}`);
    if (relation?.kind === 'INHERITANCE') return [];
    const one = relation?.kind === 'ONE_TO_ONE' || relation?.kind === 'COMPOSITION';
    return [{ name: camel(column.name.replace(/_id$/, '')), annotation: one ? 'OneToOne' : 'ManyToOne', targetClassName: pascal(target.name), joinColumn: column.name, cascade: foreignKey.onDelete === 'CASCADE' }];
  });
  const parentTable = parent ? entityTables.find((item) => item.id === parent.tableIds[1]) : undefined;
  const fields = tableColumns(table, model);
  const id = fields.find((item) => item.id);
  if (!id) throw new Error(`Entity table ${table.id} has no scalar primary key.`);
  return { packageName: basePackage, className: pascal(table.name), tableName: table.name, root: child, parentClassName: parentTable ? pascal(parentTable.name) : undefined, id, fields, createFields: fields.filter((item) => !item.generated), updateFields: fields.filter((item) => !item.id), relationships };
}

function safeFile(path: string): boolean {
  return !isAbsolute(path) && !path.split(/[\\/]+/).some((segment) => segment === '..' || segment === '');
}

function planFile(files: GeneratedFile[], path: string, content: string, diagnostics: SpringGeneratorDiagnostic[]) {
  const normalized = path.replaceAll('\\', '/');
  if (!safeFile(normalized)) { diagnostics.push(diagnostic('UNSAFE_OUTPUT_PATH', 'Generated file path must remain relative to the selected output root.', path)); return; }
  if (files.some((file) => file.path === normalized)) { diagnostics.push(diagnostic('DUPLICATE_OUTPUT_PATH', 'Generated file paths must be unique after normalization.', normalized)); return; }
  files.push({ path: normalized, content, sha256: sha256(content) });
}

async function addTemplate(files: GeneratedFile[], diagnostics: SpringGeneratorDiagnostic[], path: string, template: string, context: TemplateContext) {
  planFile(files, path, await render(template, context), diagnostics);
}

function relationName(relation: RelationalRelation) { return pascal(relation.id.replace(/^relation:/, '').replaceAll(':', '_')); }

export async function writeGeneratedFiles(outputRoot: string, files: GeneratedFile[]): Promise<SpringGeneratorDiagnostic[]> {
  const root = resolve(outputRoot);
  const seen = new Set<string>();
  for (const file of files) {
    const normalized = file.path.replaceAll('\\', '/');
    const destination = resolve(root, normalized);
    if (!safeFile(normalized) || seen.has(normalized) || relative(root, destination).startsWith('..')) {
      return [diagnostic(seen.has(normalized) ? 'DUPLICATE_OUTPUT_PATH' : 'UNSAFE_OUTPUT_PATH', 'Generated files must be unique relative paths contained by the selected output root.', file.path)];
    }
    seen.add(normalized);
  }
  for (const file of files) { const destination = resolve(root, file.path); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, file.content, 'utf8'); }
  return [];
}

export async function generateSpringProject(model: RelationalModel, options: SpringGeneratorOptions = {}): Promise<SpringGenerationResponse> {
  const diagnostics: SpringGeneratorDiagnostic[] = [];
  const basePackage = options.basePackage ?? DEFAULT_PACKAGE;
  if (!packageIsSafe(basePackage)) diagnostics.push(diagnostic('INVALID_BASE_PACKAGE', 'Base package must be a lowercase dot-separated Java package outside reserved roots.', 'options.basePackage'));
  if (model.version !== 1) diagnostics.push(diagnostic('UNSUPPORTED_RELATIONAL_MODEL', 'Only RelationalModel version 1 is supported.', 'model.version'));
  if (diagnostics.length > 0) return { diagnostics, files: [] };
  const files: GeneratedFile[] = [];
  const basePath = javaPath(basePackage);
  const entities = model.tables.filter((table) => table.kind === 'ENTITY').map((table) => entityContext(table, model, basePackage)).sort((left, right) => compare(left.className, right.className));
  const templateContext = { basePackage, applicationClassName: 'GeneratedApplication', entities, relations: model.relations.map((relation) => ({ name: relationName(relation), kind: relation.kind })) };
  await addTemplate(files, diagnostics, 'build.gradle', 'build', templateContext);
  await addTemplate(files, diagnostics, 'settings.gradle', 'settings', templateContext);
  await addTemplate(files, diagnostics, 'gradlew', 'gradlew', templateContext);
  await addTemplate(files, diagnostics, 'gradlew.bat', 'gradlew-bat', templateContext);
  await addTemplate(files, diagnostics, 'gradle/wrapper/gradle-wrapper.properties', 'gradle-wrapper-properties', templateContext);
  await addTemplate(files, diagnostics, 'src/main/resources/application.yml', 'application-yml', templateContext);
  await addTemplate(files, diagnostics, `src/main/java/${basePath}/GeneratedApplication.java`, 'application', templateContext);
  await addTemplate(files, diagnostics, `src/main/java/${basePath}/errors/ApiError.java`, 'api-error', templateContext);
  await addTemplate(files, diagnostics, `src/main/java/${basePath}/errors/RestExceptionHandler.java`, 'exception-handler', templateContext);
  await addTemplate(files, diagnostics, `src/main/java/${basePath}/config/JacksonConfig.java`, 'jackson-config', templateContext);
  await addTemplate(files, diagnostics, `src/main/java/${basePath}/config/OpenApiConfig.java`, 'openapi-config', templateContext);
  for (const enumeration of model.enums) await addTemplate(files, diagnostics, `src/main/java/${basePath}/domain/${pascal(enumeration.name)}.java`, 'enum', { ...templateContext, enumName: pascal(enumeration.name), literals: enumeration.literals });
  for (const entity of entities) {
    const root = `src/main/java/${basePath}`;
    await addTemplate(files, diagnostics, `${root}/domain/${entity.className}.java`, 'entity', entity);
    await addTemplate(files, diagnostics, `${root}/persistence/${entity.className}Repository.java`, 'repository', entity);
    await addTemplate(files, diagnostics, `${root}/api/dto/Create${entity.className}Request.java`, 'create-dto', entity);
    await addTemplate(files, diagnostics, `${root}/api/dto/Update${entity.className}Request.java`, 'update-dto', entity);
    await addTemplate(files, diagnostics, `${root}/api/dto/${entity.className}Response.java`, 'response-dto', entity);
    await addTemplate(files, diagnostics, `${root}/application/${entity.className}Mapper.java`, 'mapper', entity);
    await addTemplate(files, diagnostics, `${root}/application/${entity.className}Service.java`, 'service', entity);
    await addTemplate(files, diagnostics, `${root}/api/${entity.className}Controller.java`, 'controller', entity);
  }
  files.sort((left, right) => compare(left.path, right.path));
  if (diagnostics.length > 0) return { diagnostics, files: [] };
  if (options.outputRoot) {
    const writeDiagnostics = await writeGeneratedFiles(options.outputRoot, files);
    if (writeDiagnostics.length > 0) return { diagnostics: writeDiagnostics, files: [] };
  }
  return { diagnostics: [], result: { basePackage, files, manifest: { algorithm: 'sha256', files: files.map((file) => ({ path: file.path, sha256: file.sha256 })) } }, files };
}
