/* eslint-disable @typescript-eslint/no-require-imports */
const ts = require('typescript');
const { createHash } = require('node:crypto');
module.exports = function (source) {
  if (this.resourcePath.endsWith('.css')) {
    const locals = {};
    let css = source;
    if (this.resourcePath.endsWith('.module.css')) {
      // Match CSS Modules' per-file isolation, including identically named classes.
      const prefix = `fixture_${createHash('sha1').update(this.resourcePath).digest('hex').slice(0, 8)}_`;
      const globals = [];
      css = css.replace(/:global\(([^)]+)\)/g, (_, value) => `__GLOBAL_${globals.push(value) - 1}__`);
      css = css.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => { locals[name] = `${prefix}${name}`; return `.${locals[name]}`; });
      css = css.replace(/__GLOBAL_(\d+)__/g, (_, index) => globals[index]);
    }
    return `const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.head.append(style); export default ${JSON.stringify(locals)};`;
  }
  return ts.transpileModule(source, { fileName: this.resourcePath, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
};
