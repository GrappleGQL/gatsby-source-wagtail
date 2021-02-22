const selfPkgjson = require.resolve('gatsby-source-wagtail/package.json')
export const selfFolder = path.resolve(selfPkgjson, '../')
export const previewTemplate = path.resolve(selfFolder, 'preview-template.js')
