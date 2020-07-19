
# gatsby-source-wagtail

> NOTE: This plugin requires that your Wagtail site use the [Wagtail-Grapple](https://github.com/torchbox/wagtail-grapple)
library to build a compatible GraphQL endpoint. It does not work without a GraphQL endpoint.

## Features: 🚀
* Stitches your Wagtail GraphQL endpoint into the internal Gatsby one.
* Simple router that matches your Django models to Gatsby templates.
* Redirect support, making your Wagtail redirects work with sites hosted on Netlify & S3.
* Out-of-the-box Wagtail Preview with realtime update as you type in the admin.
* Gatsby Image Support 🔥
* Incremental builds using `GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES=true ` flag.

## How to use

### Installation

`npm install gatsby-source-wagtail`

### Configuration

Add the package to your `gatsby-config.js` with the url to your Wagtail GQL endpoint:

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
| url          | Y        | The Wagtail GraphQL endpoint URL                                                                                                                                                                                                                                                                        | string   | null     |
| websocketUrl | N*       | The GraphQL subscriptions endpoint URL. It can be inferred during development, but needs to be set in a production env                                                                                                                                                                          | string   | N/A      |
| headers      | N        | A JSON object of headers you want appended to all HTTP requests (Gatsby Build + Page Preview).                                                                                                                                                                                                                 | json     | {}       |
| fieldName    | N*       | The field name you want your remote endpoint accessible under. If you have multiple connections then you will need to provide a value for at least one of them.                                                                                                                                                | string   |  wagtail |
| typeName     | N*       | The remote schema's internal type name. When you have multiple connections, you will need to provide a value (just copy fieldName).                                                                                                                                          | string   | wagtail  |
| isDefault    | N*       | A settings that tells the plugin which Wagtail GraphQL endpoint is the primary/default one. Used for preview and page generation. If you have multiple connections, you must choose which one you will generate pages from. Multiple site page generation is planned for future development. | string   | true     |


### Page Router
This source plugin provides a simple router that maps a Django model to a specific Gatsby template. Pass a JSON map to the function in your `gatsby-node.js`. 
The router also adds Wagtail Preview to your Gatsby site automagically! Now point your backend to the Gatsby site and everything will work: [How to link Wagtail & Gatsby](LINK TO BACKEND DOCS).

To map a Django model with the `home.BlogPage` ContentType to a template located at `./src/templates/blog.js`

```js
const { createWagtailPages } = require("gatsby-source-wagtail/pages.js")

exports.createPages = ({ graphql, actions }) => {
  return createWagtailPages({
      "home.BlogPage": "templates/blog.js",
  }, graphql, actions, [])
}
```

The example template:


```jsx
...

export default ({ data }) => {
  const { page } = data.wagtail.page

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

Some page specific information is passed to page through the Gatsby context prop. The following variables are passed, thus are available in templates:

* $id: Int
* $slug: String
* $url: String
* $contentType: String

### Redirects
The plugin queries your Wagtail endpoint for any defined redirects and pass them to the Gatsby `createRedirect` function.

### Image Fragments
You can take advantage of the [Gatsby Image](https://www.gatsbyjs.org/packages/gatsby-image/) processing abilites by allowing Gatsby to download your images and progressively enhance them on the page.

```jsx
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

`gatsby-transformer-sharp` and `gatsby-plugin-sharp` are required for local image processing.

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

When previewing the page using Wagtail Preview, the image processing is mocked and the plugin will use the raw source files from your Wagtail's media host. It should, however, respect the image dimension constraints.
