declare module 'mailparser' {
  export interface ParsedMail {
    from?: {
      value: Array<{
        address?: string;
        name?: string;
      }>;
      text?: string;
    };
    to?: {
      value: Array<{
        address?: string;
        name?: string;
      }>;
      text?: string;
    };
    subject?: string;
    text?: string;
    html?: string | false;
    attachments?: Attachment[];
    headers?: Map<string, any>;
  }

  export interface Attachment {
    filename?: string;
    contentType?: string;
    content?: Buffer;
    size?: number;
    contentDisposition?: string;
  }

  export function simpleParser(source: any): Promise<ParsedMail>;
}
