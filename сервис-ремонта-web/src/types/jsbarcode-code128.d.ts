declare module "jsbarcode/bin/barcodes/CODE128/CODE128_AUTO.js" {
  type Code128Encoding = { data: string; text?: string };

  class Code128Auto {
    constructor(value: string, options: { text: string });
    valid(): boolean;
    encode(): Code128Encoding;
  }

  export default Code128Auto;
}
