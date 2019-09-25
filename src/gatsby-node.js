const fs = require('fs-extra');
const request = require('graphql-request')
const { sourceNodes } = require('./graphql-nodes');
const { getRootQuery } = require('./getRootQuery');
const { generateImageFragments } = require('./fragments')

const queryBackend = (query, url, headers) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({
    variables: {},
    query,
  }),
}).then(result => result.json())

// Monkeypatch options to allow default fieldName and typeName
exports.onPreInit = ({}, options) => {
  options.fieldName = options.fieldName || 'wagtail'
  options.typeName = options.typeName || 'wagtail'
}

// Stick remote Wagtail schema into local GraphQL endpoint
exports.sourceNodes = sourceNodes

exports.onPostBootstrap = async ({ getNodes, cache, actions }, options) => {
  // Get all pages and see when they were last updated.
  const result = await queryBackend(`
    {
      pages {
        id
        url
      }
    }
  `, options.url, options.headers)

  // If no result then stop!
  if (!result.data && result.data.pages)
    return;

  // All pages in Gatsby system
  const pageNodes = getNodes()
    .filter(node => node.internal.type == 'SitePage')
    
  // Iterate over each page and check if has changed.
  result.data.pages.map(async page => {
    const pageCacheKey = `page-${page.id}`
    const cacheResult = await cache.get(pageCacheKey)    

    // If has cache result then find matching page node.
    if (cacheResult) {
      const node = pageNodes.find(node => node.path == page.url)
      if (node) {
        console.log(`Result:`, node.id, cacheResult)
        actions.touchNode({
          nodeId: node.id
        })
      }
    }

    // Update local cache
    cache.set(pageCacheKey, page)
  })
}

exports.onCreatePage = ({ page, actions }, options) => {
  const rootQuery = getRootQuery(page.componentPath);
  if (rootQuery) {
    page.context = page.context || {};
    page.context.rootQuery = rootQuery;
    actions.createPage(page);
  }

  queryBackend(`
    {
      __schema {
        types {
          kind
          name
          possibleTypes {
            name
          }
        }
      }
    }
  `, options.url, options.headers).then(result => {
      // here we're filtering out any type information unrelated to unions or interfaces
      const filteredData = result.data.__schema.types.filter(
        type => type.possibleTypes !== null,
      );
      result.data.__schema.types = filteredData;
      fs.writeFile('./node_modules/gatsby-source-wagtail/fragmentTypes.json', JSON.stringify(result.data), err => {
        if (err) {
          console.error('Gatsby-source-wagtail: Error writing fragmentTypes file', err);
        }
      });
    });
};

exports.onCreateWebpackConfig = ({ stage, actions, getConfig }) => {
  const config = getConfig()
  if (stage.indexOf('html') >= 0) {
    return;
  }

  const replaceRule = ruleUse => {
    if (ruleUse.loader && ruleUse.loader.indexOf(`gatsby/dist/utils/babel-loader.js`) >= 0) {
      ruleUse.loader = require.resolve(`gatsby-source-wagtail/babel-loader.js`);
    }
  }

  const traverseRule = rule => {
    if (rule.oneOf && Array.isArray(rule.oneOf)) {
      rule.oneOf.forEach(traverseRule);
    }

    if (rule.use) {
      if (Array.isArray(rule.use)) {
        rule.use.forEach(replaceRule);
      } else {
        replaceRule(rule.use);
      }
    }

  };
  config.module.rules.forEach(traverseRule)
  actions.replaceWebpackConfig(config)
};

exports.onPreExtractQueries = async ({ store, actions }, options) => {
  const { createRedirect } = actions

  queryBackend(`{
    imageType
    redirects {
      oldPath
      newUrl
      isPermanent
    }
  }`, options.url, options.headers).then(({ data }) => {
    // Generate Image Fragments for the servers respective image model.
    const program = store.getState().program
    const fragments = generateImageFragments(data.imageType)
    fs.writeFile(
      `${program.directory}/.cache/fragments/gatsby-source-wagtail-fragments.js`, 
      fragments, 
      err => console.error(err)
    )

    // Generate redirects for Netlify, controlled by Wagtail Admin.
    data.redirects
      .map(redirect => createRedirect({
        fromPath: redirect.oldPath,
        toPath: redirect.newUrl,
        isPermanent: redirect.isPermanent
      }))
  })
}
