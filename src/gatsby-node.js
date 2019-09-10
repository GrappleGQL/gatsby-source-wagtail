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

// Load wagtail schema
exports.sourceNodes = sourceNodes

// Touch any non-updated nodes.
exports.onPostBootstrap = ({ getNodes, cache, actions }, options) => {
  const { touchNode } = actions
  const pageNodes = getNodes()
    .filter(node => node.internal.type == 'SitePage')

  queryBackend(`
    {
      pages {
        id
        url
        hash: lastPublishedAt
      }
    }
  `, options.url, options.headers).then(result => {      
    result.data.pages.map(page => {
      const pageCacheKey = `page-${page.id}`
      cache.get(pageCacheKey).then(pageHash => {
        if (pageHash && pageHash == page.hash) {
          const node = pageNodes.find(node => node.path == page.url)
          touchNode({
            nodeId: node.id
          })
        } else {
          cache.set(pageCacheKey, page.hash)
        }
      })
    })
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
