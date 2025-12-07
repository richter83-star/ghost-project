import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || '/api';

class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });

    // Load API key from localStorage
    const savedKey = localStorage.getItem('dashboard_api_key');
    if (savedKey) {
      this.setApiKey(savedKey);
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
    this.client.defaults.headers.common['X-API-Key'] = key;
  }

  private getConfig() {
    return {
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
      params: this.apiKey ? { apiKey: this.apiKey } : {},
    };
  }

  async getStatus() {
    const response = await this.client.get('/dashboard/status', this.getConfig());
    return response.data;
  }

  async getAgents() {
    const response = await this.client.get('/dashboard/agents', this.getConfig());
    return response.data;
  }

  async getRecommendations() {
    const response = await this.client.get('/dashboard/recommendations', this.getConfig());
    return response.data;
  }

  async getRecommendation(id: string, agent: string) {
    const response = await this.client.get(`/dashboard/recommendations/${id}?agent=${agent}`, this.getConfig());
    return response.data;
  }

  async approveRecommendation(id: string, agent: string) {
    const response = await this.client.post(
      `/dashboard/recommendations/${id}/approve`,
      { agent },
      this.getConfig()
    );
    return response.data;
  }

  async rejectRecommendation(id: string, agent: string, reason?: string) {
    const response = await this.client.post(
      `/dashboard/recommendations/${id}/reject`,
      { agent, reason },
      this.getConfig()
    );
    return response.data;
  }

  async getOutputs(limit?: number) {
    const response = await this.client.get('/dashboard/outputs', {
      ...this.getConfig(),
      params: { ...this.getConfig().params, limit },
    });
    return response.data;
  }

  async getLogs(limit?: number, agent?: string, level?: string) {
    const response = await this.client.get('/dashboard/logs', {
      ...this.getConfig(),
      params: { ...this.getConfig().params, limit, agent, level },
    });
    return response.data;
  }

  async getMetrics() {
    const response = await this.client.get('/dashboard/metrics', this.getConfig());
    return response.data;
  }

  async triggerAgentRun(agentId: string) {
    const response = await this.client.post(`/dashboard/agents/${agentId}/run`, {}, this.getConfig());
    return response.data;
  }

  async toggleAgent(agentId: string, enabled: boolean) {
    const response = await this.client.post(
      `/dashboard/agents/${agentId}/toggle`,
      { enabled },
      this.getConfig()
    );
    return response.data;
  }

  async getSettings() {
    const response = await this.client.get('/dashboard/settings', this.getConfig());
    return response.data;
  }
}

export const apiClient = new ApiClient();

