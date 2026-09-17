import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RelationalModel } from '@examen-sw1/relational-core';
import { generateSpringProject, verifyGeneratedProject, writeGeneratedFiles } from '../src/index.js';
import { knownCanonicalFixture, knownFixtureMetadata } from './known-canonical-fixture.js';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';

const column = (table: string, name: string, javaType: 'Long' | 'String' = 'Long', options: Partial<{ generated: boolean; nullable: boolean; enumId: string }> = {}) => ({ id: `column:${table}:${name}`, name, sqlType: javaType === 'Long' ? 'BIGINT' as const : 'VARCHAR(255)' as const, javaType, nullable: options.nullable ?? false, generated: options.generated ?? false, ...(options.enumId ? { enumId: options.enumId } : {}) });
const accountId = column('table:account', 'id', 'Long', { generated: true });
const profileId = column('table:profile', 'id', 'Long');
const model: RelationalModel = {
  version: 1,
  enums: [{ id: 'enum:status', name: 'status', sourceEnumerationId: 'status', literals: ['ACTIVE', 'DISABLED'] }],
  tables: [
    { id: 'table:account', name: 'account', kind: 'ENTITY', columns: [accountId, column('table:account', 'name', 'String'), { ...column('table:account', 'status', 'String', { enumId: 'enum:status' }), nullable: true }], primaryKey: { name: 'pk_account', columnIds: [accountId.id] }, foreignKeys: [], uniqueConstraints: [], indexes: [], checkConstraints: [] },
    { id: 'table:profile', name: 'profile', kind: 'ENTITY', columns: [profileId], primaryKey: { name: 'pk_profile', columnIds: [profileId.id] }, foreignKeys: [{ id: 'fk:profile:account', name: 'fk_profile_account', columnIds: [profileId.id], referencedTableId: 'table:account', referencedColumnIds: [accountId.id], onDelete: 'NO ACTION' }], uniqueConstraints: [], indexes: [], checkConstraints: [] },
    { id: 'table:invoice', name: 'invoice', kind: 'ENTITY', columns: [column('table:invoice', 'id', 'Long', { generated: true }), { ...column('table:invoice', 'account_id'), nullable: false }], primaryKey: { name: 'pk_invoice', columnIds: ['column:table:invoice:id'] }, foreignKeys: [{ id: 'fk:invoice:account', name: 'fk_invoice_account', columnIds: ['column:table:invoice:account_id'], referencedTableId: 'table:account', referencedColumnIds: [accountId.id], onDelete: 'CASCADE' }], uniqueConstraints: [], indexes: [], checkConstraints: [] },
  ],
  relations: [
    { id: 'relation:profile-account', kind: 'INHERITANCE', sourceRelationshipId: 'profile-account', tableIds: ['table:profile', 'table:account'], ownerTableId: 'table:profile' },
    { id: 'relation:invoice-account', kind: 'COMPOSITION', sourceRelationshipId: 'invoice-account', tableIds: ['table:invoice', 'table:account'], ownerTableId: 'table:invoice' },
  ],
};

const generated = async () => {
  const output = await generateSpringProject(model);
  expect(output.diagnostics).toEqual([]);
  expect(output.result).toBeDefined();
  return output;
};
const file = (output: Awaited<ReturnType<typeof generated>>, path: string) => {
  const content = output.files.find((item) => item.path === path)?.content;
  return typeof content === 'string' ? content : '';
};

describe('generateSpringProject', () => {
  it('uses a stable default and supports a safe configured package', async () => {
    const defaultOutput = await generated();
    expect(defaultOutput.result?.basePackage).toBe('com.generated.app');
    const configured = await generateSpringProject(model, { basePackage: 'org.example.generated' });
    expect(configured.files.some((item) => item.path.includes('org/example/generated/GeneratedApplication.java'))).toBe(true);
    await expect(generateSpringProject(model, { basePackage: 'Java.Bad' })).resolves.toMatchObject({ diagnostics: [expect.objectContaining({ code: 'INVALID_BASE_PACKAGE' })] });
  });

  it('rejects unsafe and duplicate writer paths before writing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spring-generator-'));
    try {
      expect(await writeGeneratedFiles(root, [{ path: '../escape.txt', content: 'no', sha256: 'x' }])).toMatchObject([{ code: 'UNSAFE_OUTPUT_PATH' }]);
      expect(await writeGeneratedFiles(root, [{ path: 'safe.txt', content: 'one', sha256: 'x' }, { path: 'safe.txt', content: 'two', sha256: 'y' }])).toMatchObject([{ code: 'DUPLICATE_OUTPUT_PATH' }]);
      const output = await generateSpringProject(model, { outputRoot: root });
      expect(output.diagnostics).toEqual([]);
      await expect(readFile(join(root, 'build.gradle'), 'utf8')).resolves.toContain("org.springframework.boot' version '4.0.0'");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('is deterministic and includes Gradle configuration and the official wrapper asset', async () => {
    const first = await generated(); const second = await generated();
    expect(first.result?.manifest).toEqual(second.result?.manifest);
    expect(first.files.map((item) => item.path)).toEqual([...first.files.map((item) => item.path)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(file(first, 'build.gradle')).toContain("springdoc-openapi-starter-webmvc-ui");
    expect(file(first, 'build.gradle')).toContain("runtimeOnly 'com.h2database:h2'");
    expect(file(first, 'gradle/wrapper/gradle-wrapper.properties')).toContain('gradle-9.2.0-bin.zip');
    expect(first.files.find((item) => item.path.endsWith('.jar'))?.sha256).toBe('423cb469ccc0ecc31f0e4e1c309976198ccb734cdcbb7029d4bda0f18f57e8d9');
  });

  it('maps the known canonical fixture before generation with semantic relational assertions', () => {
    const mapped = mapCanonicalUmlModel(knownCanonicalFixture, knownFixtureMetadata);
    expect(mapped.success).toBe(true);
    if (!mapped.success) return;
    expect(mapped.model.enums).toHaveLength(1);
    expect(mapped.model.tables.some((table) => table.kind === 'JOIN')).toBe(true);
    expect(mapped.model.relations.map((relation) => relation.kind)).toEqual(expect.arrayContaining(['INHERITANCE', 'ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY', 'AGGREGATION', 'COMPOSITION']));
    expect(mapped.model.tables.find((table) => table.name === 'customer')?.primaryKey.columnIds).toHaveLength(1);
  });

  it('generates the known fixture twice and builds it with its isolated Gradle Wrapper harness', async () => {
    await expect(verifyGeneratedProject(knownCanonicalFixture, knownFixtureMetadata)).resolves.toBeUndefined();
  }, 240_000);

  it('renders primitive columns, enums, joined inheritance, relationships, and API layers from the relational model', async () => {
    const output = await generated();
    expect(file(output, 'src/main/java/com/generated/app/domain/Account.java')).toContain('@Inheritance(strategy = InheritanceType.JOINED)');
    expect(file(output, 'src/main/java/com/generated/app/domain/Account.java')).toContain('@Enumerated(EnumType.STRING)');
    expect(file(output, 'src/main/java/com/generated/app/domain/Profile.java')).toContain('extends Account');
    expect(file(output, 'src/main/java/com/generated/app/domain/Profile.java')).toContain('@PrimaryKeyJoinColumn(name = "id")');
    expect(file(output, 'src/main/java/com/generated/app/domain/Invoice.java')).toContain('@ManyToOne(fetch = FetchType.LAZY)');
    expect(file(output, 'src/main/java/com/generated/app/domain/Invoice.java')).toContain('@OnDelete(action = OnDeleteAction.CASCADE)');
    expect(file(output, 'src/main/java/com/generated/app/persistence/InvoiceRepository.java')).toContain('JpaRepository<Invoice, Long>');
    expect(file(output, 'src/main/java/com/generated/app/api/dto/CreateAccountRequest.java')).toContain('@NotNull @Size(max = 255) String name');
    expect(file(output, 'src/main/java/com/generated/app/api/AccountController.java')).toContain('@RequestMapping("/api/account")');
    expect(file(output, 'src/main/java/com/generated/app/api/AccountController.java')).toContain('@ApiResponse(responseCode = "400"');
    expect(file(output, 'src/main/java/com/generated/app/api/AccountController.java')).toContain('@ApiResponse(responseCode = "404"');
    expect(file(output, 'src/main/java/com/generated/app/errors/RestExceptionHandler.java')).toContain('VALIDATION_ERROR');
    expect(file(output, 'src/main/resources/application.yml')).toContain('jdbc:postgresql');
    expect(output.files.every((item) => typeof item.content !== 'string' || !/nestjs|prisma|frontend/i.test(item.content))).toBe(true);
  });

  it('derives bidirectional relationship navigation and DTO endpoints solely from the known relational model', async () => {
    const mapped = mapCanonicalUmlModel(knownCanonicalFixture, knownFixtureMetadata);
    expect(mapped.success).toBe(true);
    if (!mapped.success) return;
    const first = await generateSpringProject(mapped.model);
    const second = await generateSpringProject(mapped.model);
    expect(first.result?.manifest).toEqual(second.result?.manifest);

    const order = file(first, 'src/main/java/com/generated/app/domain/PurchaseOrder.java');
    const product = file(first, 'src/main/java/com/generated/app/domain/Product.java');
    const customer = file(first, 'src/main/java/com/generated/app/domain/Customer.java');
    const profile = file(first, 'src/main/java/com/generated/app/domain/Profile.java');
    const line = file(first, 'src/main/java/com/generated/app/domain/OrderLine.java');
    expect(product).toContain('@ManyToMany(fetch = FetchType.LAZY)');
    expect(product).toContain('@JoinTable(name = "product_purchase_order_ordered_products"');
    expect(product).toContain('Set<PurchaseOrder> purchaseOrders = new LinkedHashSet<>()');
    expect(order).toContain('@ManyToMany(mappedBy = "purchaseOrders", fetch = FetchType.LAZY)');
    expect(order).toContain('Set<Product> products = new LinkedHashSet<>()');
    expect(file(first, 'src/main/java/com/generated/app/application/PurchaseOrderService.java')).toContain('new RelationshipResponse("products", entity.getProducts().stream()');
    expect(file(first, 'src/main/java/com/generated/app/application/ProductService.java')).toContain('new RelationshipResponse("purchaseOrders", entity.getPurchaseOrders().stream()');
    expect(file(first, 'src/main/java/com/generated/app/api/PurchaseOrderController.java')).toContain('RelationshipResponse relationship');
    expect(file(first, 'src/main/java/com/generated/app/api/ProductController.java')).toContain('RelationshipResponse relationship');
    expect(file(first, 'src/main/java/com/generated/app/api/dto/RelationshipResponse.java')).toContain('List<Object> ids');
    expect(file(first, 'src/main/java/com/generated/app/persistence/PurchaseOrderRepository.java')).toContain('JpaRepository<PurchaseOrder, Long>');
    expect(file(first, 'src/main/java/com/generated/app/persistence/ProductRepository.java')).toContain('JpaRepository<Product, Long>');
    expect(file(first, 'src/main/java/com/generated/app/api/dto/PurchaseOrderResponse.java')).not.toContain('Product');

    expect(customer).toContain('@OneToOne(fetch = FetchType.LAZY)');
    expect(profile).toContain('@OneToOne(mappedBy = "profile", fetch = FetchType.LAZY)');
    expect(customer).toContain('@OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)');
    expect(line).toContain('@ManyToOne(fetch = FetchType.LAZY)');
    expect(order).toContain('@OneToMany(mappedBy = "purchaseOrder", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)');
    expect(line).toContain('@OnDelete(action = OnDeleteAction.CASCADE)');
    expect(product).toContain('@ManyToOne(fetch = FetchType.LAZY)');
    const aggregation = customer.match(/@OneToMany\(mappedBy = "customer", fetch = FetchType.LAZY\)[\s\S]*?private Set<Product> products/);
    expect(aggregation?.[0]).toBeDefined();
    expect(aggregation?.[0]).not.toContain('CascadeType.ALL');
    expect(aggregation?.[0]).not.toContain('orphanRemoval');
    const aggregationOwner = product.match(/@ManyToOne\(fetch = FetchType.LAZY\)[\s\S]*?private Customer customer/);
    expect(aggregationOwner?.[0]).toBeDefined();
    expect(aggregationOwner?.[0]).not.toContain('CascadeType.ALL');
    expect(aggregationOwner?.[0]).not.toContain('orphanRemoval');
    expect(aggregationOwner?.[0]).not.toContain('@OnDelete');
  });
});
