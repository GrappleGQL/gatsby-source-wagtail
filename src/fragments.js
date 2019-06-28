export const wagtailImageFixed = graphql`
    fragment WagtailImageFixed on ImageObjectType {
        base64
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
    }
`

export const wagtailImageFixedTracedSVG = graphql`
    fragment WagtailImageFixed_tracedSVG on ImageObjectType {
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
        tracedSVG
    }
`

export const wagtailImageFixedNoBase64 = graphql`
    fragment WagtailImageFixed_noBase64 on ImageObjectType {
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
    }
`

export const wagtailImageFluid = graphql`
    fragment WagtailImageFluid on ImageObjectType {
        base64
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }
`

export const wagtailImageFluidTracedSVG = graphql`
    fragment WagtailImageFluid_tracedSVG on ImageObjectType {
        tracedSVG
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }
`

export const wagtailImageFluidNoBase64 = graphql`
    fragment WagtailImageFluid_noBase64 on ImageObjectType {
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }
`
