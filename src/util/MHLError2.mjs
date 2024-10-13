class MHLError2 extends Error {
  constructor(message, data) {
    super(message);
    this.name = this.constructor.name;
    console.error(data)
  }
}