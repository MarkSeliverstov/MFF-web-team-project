const typeDefs = `
    type Query{
        websites: [WebPage!]!
        nodes(webPages: [ID!]): [Node!]!
    }

    type WebPage{
        identifier: ID
        label: String!
        url: String!
        regexp: String!
        tags: [String!]!	
        active: Boolean!
    }

    type Node{
        title: String
        url: String!
        crawlTime: String
        links: [Node!]!
        owner: WebPage!
    }
`;

export default typeDefs;
