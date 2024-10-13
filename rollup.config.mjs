import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "src/init.mjs",
  output: {
    file: "mhl-dist.mjs",
    format: "es",
  },
  plugins: [commonjs(), resolve()],
};
