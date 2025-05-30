import { Config, makeIngestMetaStore } from "mongodb-rag-ingest";
import { standardChunkFrontMatterUpdater } from "mongodb-rag-core";
import {
  assertEnvVars,
  makeOpenAiEmbedder,
  makeMongoDbEmbeddedContentStore,
  makeMongoDbPageStore,
  filterFulfilled,
} from "mongodb-rag-core";
import { AzureOpenAI } from "mongodb-rag-core/openai";
import { PUBLIC_INGEST_ENV_VARS } from "./PublicIngestEnvVars";
import { sourceConstructors } from "./sources";
import {
  makeSnootyDataSources,
  snootyDataApiBaseUrl,
  snootyProjectConfig,
} from "./sources/snootySources";

const {
  OPENAI_ENDPOINT,
  OPENAI_API_KEY,
  OPENAI_API_VERSION,
  OPENAI_RETRIEVAL_EMBEDDING_DEPLOYMENT,
  MONGODB_CONNECTION_URI,
  MONGODB_DATABASE_NAME,
} = assertEnvVars(PUBLIC_INGEST_ENV_VARS);

const embedder = makeOpenAiEmbedder({
  openAiClient: new AzureOpenAI({
    apiKey: OPENAI_API_KEY,
    endpoint: OPENAI_ENDPOINT,
    apiVersion: OPENAI_API_VERSION,
  }),
  deployment: OPENAI_RETRIEVAL_EMBEDDING_DEPLOYMENT,
  backoffOptions: {
    numOfAttempts: 25,
    startingDelay: 1000,
  },
});

export const standardConfig = {
  embedder: () => embedder,
  embeddedContentStore: () =>
    makeMongoDbEmbeddedContentStore({
      connectionUri: MONGODB_CONNECTION_URI,
      databaseName: MONGODB_DATABASE_NAME,
      collectionName: process.env.MONGODB_EMBEDDED_CONTENT_COLLECTION_NAME,
      searchIndex: {
        embeddingName: OPENAI_RETRIEVAL_EMBEDDING_DEPLOYMENT,
        name: OPENAI_RETRIEVAL_EMBEDDING_DEPLOYMENT,
      },
    }),
  pageStore: () =>
    makeMongoDbPageStore({
      connectionUri: MONGODB_CONNECTION_URI,
      databaseName: MONGODB_DATABASE_NAME,
      collectionName: process.env.MONGODB_COLLECTION_NAME ?? "pages_with_links",
    }),
  ingestMetaStore: () =>
    makeIngestMetaStore({
      connectionUri: MONGODB_CONNECTION_URI,
      databaseName: MONGODB_DATABASE_NAME,
      entryId: "all:pages_with_links",
    }),
  chunkOptions: () => ({
    transform: standardChunkFrontMatterUpdater,
  }),
  concurrencyOptions: () => ({
    embed: {
      createChunks: 5,
    },
  }),
  dataSources: async () => {
    return makeSnootyDataSources(snootyDataApiBaseUrl, snootyProjectConfig, {
      includeLinks: true,
      includeRefAnchors: true,
    });
  },
} satisfies Config;

export default standardConfig;
