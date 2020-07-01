import React, { Suspense } from "react";
import { decodePreviewUrl, withPreview } from "./preview";
import { query as wagtailBaseFragments } from "../../.cache/fragments/gatsby-source-wagtail-fragments.js";
import sharpImageFragments from "gatsby-transformer-sharp/src/fragments.js"

class PreviewPage extends React.Component {
  state = {
    Component: () => null,
    fragments: wagtailBaseFragments?.source || ""
  };

  // Also import these fragments
  internalFragmentFiles = [
    sharpImageFragments
  ]

  componentDidMount() {
    if (typeof window != `undefined`) {
      // Fetch the fragment files specified by the user
      const { fragmentFiles } = this.props.pageContext;
      this.fetchFragments(fragmentFiles.map(file => require("../../src/" + file)));
      // Fetch the fragment files specified by me
      this.fetchComponent(this.internalFragmentFiles);
      this.fetchComponent();
    }
  }

  fetchFragments = fragmentModules => {
    fragmentModules.map(mod => {
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
