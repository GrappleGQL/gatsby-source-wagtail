
# gatsby-source-wagtail

> NOTE: This plugin requires that your Wagtail site uses the [Wagtail-Grapple](https://github.com/Torchbox/wagtail-grapple)
library to build a compatible GraphQL endpoint. This plugin requires an existing GraphQL endpoint and does not work with Wagtail out of the box.

## Features: 🚀
* Stitches your Wagtail GraphQL endpoint into your internal Gastby one.
* Simple router that matches your Django models to Gatsby templates.
* Redirect support which makes your Wagtail redirects work with sites hosted on Netlify & S3.
* Out-of-the-box support for Wagtail Preview with realtime updates as you type in the admin.
* Gatsby Image Support 🔥
* Support for incremental builds using `GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES=true ` flag.

## How to use

### Installation

Just install the package via NPM:
`npm install gatsby-source-wagtail`

> If you want to use the Gatsby Image fragments then you will need to install the server-side Wagtail library for this also:
[Wagtail Gatsby](https://github.com/nathhorrigan/wagtail-gatsby).

### Configuration

Simply add the package to your `gatsby-config.js` with the url to your Wagtail GQL endpoint:

```js
...
{
  resolve: "gatsby-source-wagtail",
  options: {
    url: "http://localhost:8000/graphql"
  },
},
...
```

#### Available Config Options

| Option       | Required | Description                                                                                                                                                                                                                                                                                                    | Datatype | Default  |
|--------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|----------|
| url          | Y        | The url of the Wagtail GraphQL endpoint                                                                                                                                                                                                                                                                        | string   | null     |
| websocketUrl | N*       | The url of your GraphQL subscriptions endpoint, during development this can be inferred but will likely need to be set in a production env                                                                                                                                                                          | string   | N/A      |
| headers      | N        | A JSON object of headers you want appended to all HTTP requests (Gatsby Build + Page Preview).                                                                                                                                                                                                                 | json     | {}       |
| fieldName    | N*       | The field name you want your remote endpoint accessible under. If you have multiple connections then you will need to provide a value for at least one of them.                                                                                                                                                | string   |  wagtail |
| typeName     | N*       | The internal type name of the remote schema. You can ignore this unless you have multiple connections, if so, you will need to provide a value (just copy fieldName).                                                                                                                                          | string   | wagtail  |
| isDefault    | N*       | A settings that tells the plugin which Wagtail is the default is the primary/default one and should be used for preview and page generation. If you have multiple connections then you need to choose which one you will generate pages from, multiple site page generation is planned for future development. | string   | true     |


### Page Router
This source plugin provides an easy to use router that maps a Django model to a specific Gatsby template. Simply pass a JSON map like
so to the function in your `gatsby-node.js`. This router also adds Wagtail Preview to your Gatsby site automagically! Now just point your backend
to your Gatsby site and everything will work: [How to link Wagtail & Gatsby](LINK TO BACKEND DOCS).

This maps a Django model with ContentType of `home.BlogPage` to a template located at `./src/templates/blog.js`

```js
const { createWagtailPages } = require("gatsby-source-wagtail/pages.js")

exports.createPages = ({ graphql, actions }) => {
  return createWagtailPages({
      "home.BlogPage": "templates/blog.js",
  }, graphql, actions, [])
}
```

Here is an example template:


```jsx
...

export default ({ data }) => {
  const { page } = data.wagtail

  return (
    <div>
      <h1>{ page.title }</h1>
    </div>
  )
}

export const query = graphql`
  query($slug: String) {
    wagtail {
      page(slug: $slug) {
        ...on BlogPage {
          title
        }
      }
    }
  }
`
```

As you can see some information about the specific page is passed to page through gatsby's context prop. The following passed
variables and hence are available in the templates GraphQL query are:

* $id: Int
* $slug: String
* $url: String
* $contentType: String

### Redirects
There isn't much you need to know about redirects, basically the plugin queries your Wagtail endpoint for any redirects
that have been defined and if they exist then they are passed to Gatsby `createRedirect` function which works out of the
box with Netlify & S3 hosting.

### Image Fragments
You can take advantage of [Gatsby Image's](https://www.gatsbyjs.org/packages/gatsby-image/) processing abilites by allow Gatsby to download your images and progressivly enhance them on the page.

You can download your images like so:

```
import React from "react"
import { graphql } from "gatsby"
import Img from "gatsby-image"

export default function BlogTemplate({ data }) {
    const page = data.wagtail.page
    return (
        <article>
            <h1>page?.title</h1>
            <Img fixed={page?.cover?.imageFile?.childImageSharp.square} />
        </article>
    )
}

export const query = graphql`
  query BlogIndexQuery($slug: String) {
    wagtail {
        page(slug: $slug) {
            ...on BlogPage {
                title
                cover {
                    imageFile {
                        childImageSharp {
                            square: fixed(width: 300, height: 300) {
                                ...GatsbyImageSharpFixed
                            }
                        }
                    }
                }
            }
        }
    }
  }
`
```

You will need `gatsby-transformer-sharp` and `gatsby-plugin-sharp` for local image processing to work.

The following fragments work with `gatsby-source-wagtail`:
* GatsbyImageSharpFixed
* GatsbyImageSharpFixed_noBase64
* GatsbyImageSharpFixed_tracedSVG
* GatsbyImageSharpFixed_withWebp
* GatsbyImageSharpFixed_withWebp_noBase64
* GatsbyImageSharpFixed_withWebp_tracedSVG
* GatsbyImageSharpFluid
* GatsbyImageSharpFluid_noBase64
* GatsbyImageSharpFluid_tracedSVG
* GatsbyImageSharpFluid_withWebp
* GatsbyImageSharpFluid_withWebp_noBase64
* GatsbyImageSharpFluid_withWebp_tracedSVG
* GatsbyImageSharpFluidLimitPresentationSize

When previewing this page using Wagtail's Preview functionality then the image processing functionality is mocked and  will use the raw source files from Wagtail's media host. It should however respect the image dimension constraints.
