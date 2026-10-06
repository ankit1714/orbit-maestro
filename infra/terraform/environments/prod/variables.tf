variable "project_id" {
  description = "The target Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for deployment"
  type        = string
  default     = "europe-west3" # Frankfurt (or us-central1)
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "app_domain" {
  description = "Custom domain for CORS and routing"
  type        = string
  default     = "https://scrum.enterprise.internal"
}
