declare module 'elkjs/lib/elk.bundled.js' {
  export interface ElkLayoutOptions {
    [key: string]: string;
  }

  export interface ElkNode {
    id: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    layoutOptions?: ElkLayoutOptions;
    children?: ElkNode[];
    edges?: Array<{ id: string; sources: string[]; targets: string[] }>;
  }

  export default class ELK {
    layout(graph: ElkNode): Promise<ElkNode>;
  }
}
