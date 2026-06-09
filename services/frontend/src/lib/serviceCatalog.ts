import type { Service } from "../types/architecture";

export interface CatalogEntry {
  id: string;
  name: string;
  type: string;
  category: string;
  icon: string;
  description: string;
  default_cost_estimate: number;
}

export const SERVICE_CATALOG: CatalogEntry[] = [
  { id: "functions", name: "Functions", type: "Azure Functions", category: "Compute", icon: "Cpu", description: "Serverless compute for event-driven apps", default_cost_estimate: 5 },
  { id: "app-service", name: "App Service", type: "Azure App Service", category: "Compute", icon: "Cloud", description: "Fully managed web apps & APIs", default_cost_estimate: 40 },
  { id: "aks", name: "AKS", type: "Azure Kubernetes Service", category: "Compute", icon: "Cloud", description: "Managed Kubernetes clusters", default_cost_estimate: 150 },
  { id: "acr", name: "Container Registry", type: "Azure Container Registry", category: "Compute", icon: "Cloud", description: "Managed container images", default_cost_estimate: 10 },
  { id: "blob", name: "Blob Storage", type: "Azure Blob Storage", category: "Storage", icon: "Database", description: "Scalable object storage for unstructured data", default_cost_estimate: 15 },
  { id: "cosmos", name: "Cosmos DB", type: "Azure Cosmos DB", category: "Storage", icon: "Database", description: "NoSQL database with multi-region writes", default_cost_estimate: 25 },
  { id: "sql", name: "SQL Database", type: "Azure SQL Database", category: "Storage", icon: "Database", description: "Managed relational database", default_cost_estimate: 30 },
  { id: "redis", name: "Redis Cache", type: "Azure Cache for Redis", category: "Storage", icon: "Database", description: "In-memory data cache", default_cost_estimate: 20 },
  { id: "event-grid", name: "Event Grid", type: "Azure Event Grid", category: "Messaging", icon: "MessageSquare", description: "Event routing at scale", default_cost_estimate: 7 },
  { id: "service-bus", name: "Service Bus", type: "Azure Service Bus", category: "Messaging", icon: "MessageSquare", description: "Enterprise message broker", default_cost_estimate: 12 },
  { id: "event-hubs", name: "Event Hubs", type: "Azure Event Hubs", category: "Messaging", icon: "MessageSquare", description: "Big data streaming platform", default_cost_estimate: 15 },
  { id: "queue", name: "Queue Storage", type: "Azure Queue Storage", category: "Messaging", icon: "MessageSquare", description: "Simple message queueing", default_cost_estimate: 3 },
  { id: "openai", name: "OpenAI", type: "Azure OpenAI", category: "AI", icon: "Brain", description: "GPT-4o, DALL-E, and embedding models", default_cost_estimate: 100 },
  { id: "aisearch", name: "AI Search", type: "Azure AI Search", category: "AI", icon: "Brain", description: "Vector + keyword search", default_cost_estimate: 50 },
  { id: "docintel", name: "Document Intelligence", type: "Azure Document Intelligence", category: "AI", icon: "Brain", description: "OCR and document analysis", default_cost_estimate: 20 },
  { id: "speech", name: "Speech Services", type: "Azure Speech Services", category: "AI", icon: "Brain", description: "Speech-to-text and text-to-speech", default_cost_estimate: 30 },
  { id: "apim", name: "API Management", type: "Azure API Management", category: "Networking", icon: "Cloud", description: "API gateway and developer portal", default_cost_estimate: 60 },
  { id: "cdn", name: "CDN", type: "Azure CDN", category: "Networking", icon: "Cloud", description: "Content delivery network", default_cost_estimate: 25 },
  { id: "front-door", name: "Front Door", type: "Azure Front Door", category: "Networking", icon: "Cloud", description: "Global load balancer and WAF", default_cost_estimate: 50 },
  { id: "dns", name: "DNS", type: "Azure DNS", category: "Networking", icon: "Cloud", description: "Domain name resolution", default_cost_estimate: 2 },
  { id: "monitor", name: "Monitor", type: "Azure Monitor", category: "Management", icon: "Cloud", description: "Observability and logging", default_cost_estimate: 15 },
  { id: "keyvault", name: "Key Vault", type: "Azure Key Vault", category: "Security", icon: "Cloud", description: "Secrets and key management", default_cost_estimate: 5 },
];
