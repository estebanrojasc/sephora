declare module "compressorjs" {
  interface CompressorOptions {
    quality?: number;
    mimeType?: string;
    convertSize?: number;
    success?: (result: Blob) => void;
    error?: (err: Error) => void;
  }

  export default class Compressor {
    constructor(file: File | Blob, options: CompressorOptions);
  }
}
