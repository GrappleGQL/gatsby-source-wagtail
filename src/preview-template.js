import React, { Suspense } from "react";
import { decodePreviewUrl, withPreview } from "./preview";
import { query as wagtailBaseFragments } from "../../.cache/fragments/gatsby-source-wagtail-fragments.js";

class PreviewPage extends React.Component {
  state = {
    component: () => null,
    fragments: wagtailBaseFragments.source
  };

  constructor(props) {
    super(props);
    this.fetchFragments.bind(this);
    this.fetchComponents.bind(this);
  }

  componentDidMount() {
    if (typeof window != `undefined`) {
      this.fetchComponent();
      this.fetchFragments();
    }
  }

  fetchFragments() {
    const { fragmentFiles } = this.props.pageContext;
    fragmentFiles.map(file => {
      const mod = require("../../src/" + file);
      Object.keys(mod).map(exportKey => {
        const exportObj = mod[exportKey];
        if (typeof exportObj.source == "string") {
          this.setState({
            fragments: (this.state.fragments += exportObj.source)
          });
        }
      });
    })
  }

  fetchComponent = () => {
    const { pageMap } = this.props.pageContext;
    const componentFile = require("../../src/" + pageMap[contentType]);
    this.setState({
      component: withPreview(
        componentFile.default,
        componentFile.query,
        this.state.fragments
      )
    })
  });

  render() {
    return this.state.component
  }
}

export default PreviewPage;
