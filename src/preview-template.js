import React, { Suspense } from "react";
import { decodePreviewUrl, withPreview } from "./preview.boilerplate";
import { query as wagtailBaseFragments } from "../../.cache/fragments/gatsby-source-wagtail-fragments.js";

class PreviewPage extends React.Component {
  state = {
    Component: () => null,
    fragments: wagtailBaseFragments?.source
  };

  // Also import these fragments
  internalFragmentFiles = [
    "gatsby-transformer-sharp/src/fragments.js"
  ]

  componentDidMount() {
    if (typeof window != `undefined`) {
      this.fetchFragments();

      // Fetch the fragment files specified by the user
      const { fragmentFiles } = this.props.pageContext;
      this.fetchComponent(fragmentFiles);

      /*
        Fetch the fragment files specified by me
        Using try/catch because I can't assume they have these plugins installed.
        The above I want to fail if they pass the wrong filename
      */
      try {
        this.fetchComponent(this.internalFragmentFiles);
      } catch(e) {
        console.log("Could not load internal specified fragments:", this.internalFragmentFiles)
      }
    }
  }

  fetchFragments = (fragmentFiles) => {
    fragmentFiles.map(file => {
      const mod = require("../../src/" + file);
      Object.keys(mod).map(exportKey => {
        const exportObj = mod[exportKey];
        if (typeof exportObj.source == "string") {
          this.setState({
            fragments: (this.state.fragments += exportObj?.source || "")
          });
        }
      });
    })
  }

  fetchComponent = () => {
    const { pageMap } = this.props.pageContext;
    const { content_type } = decodePreviewUrl();
    const pageMapKey = Object
      .keys(pageMap)
      .find(key => key.toLowerCase() == content_type.toLowerCase())

    const componentFile = require("../../src/" + pageMap[pageMapKey]);
    this.setState({
      Component: withPreview(
        componentFile.default,
        componentFile.query,
        this.state.fragments
      )
    })
  }

  render() {
    const { Component } = this.state
    return <Component />
  }
}

export default PreviewPage;
