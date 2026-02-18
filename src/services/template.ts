import nunjucks from "nunjucks";

export function templateEnv(baseDir: string): nunjucks.Environment {
  return new nunjucks.Environment(new nunjucks.FileSystemLoader(baseDir), {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: false,
    lstripBlocks: false
  });
}
