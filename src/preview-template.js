import React, { Suspense } from "react";
import { decodePreviewUrl, withPreview } from "./preview.boilerplate";
import { query as wagtailBaseFragments } from "../../.cache/fragments/gatsby-source-wagtail-fragments.js";

class PreviewPage extends React.Component {
  state = {
    Component: () => null,
    fragments: wagtailBaseFragments.source
  };

  componentDidMount() {
    if (typeof window != `undefined`) {
      this.fetchFragments();
      this.fetchComponent();
    }
  }

  fetchFragments = () => {
    const { fragmentFiles } = this.props.pageContext;
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
