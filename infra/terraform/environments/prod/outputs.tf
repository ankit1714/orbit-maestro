output "backend_api_url" {
  description = "The URL of the deployed Cloud Run API service"
  value       = google_cloud_run_v2_service.backend_api.uri
}

output "frontend_cockpit_url" {
  description = "The URL of the deployed Cloud Run Frontend Cockpit"
  value       = google_cloud_run_v2_service.frontend_cockpit.uri
}

output "document_ai_processor_id" {
  description = "Document AI Processor ID"
  value       = google_document_ai_processor.prd_parser.id
}

output "prd_upload_bucket" {
  description = "Cloud Storage bucket for PRD documents"
  value       = google_storage_bucket.prd_upload_bucket.name
}

output "bigquery_dataset" {
  description = "BigQuery dataset for historical delivery analytics"
  value       = google_bigquery_dataset.analytics_dataset.dataset_id
}
