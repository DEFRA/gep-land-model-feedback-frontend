#!/bin/bash
set -euo pipefail
export AWS_REGION=eu-west-2 AWS_DEFAULT_REGION=eu-west-2 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
aws_local() { aws --endpoint-url=http://localhost:4566 "$@"; }
for bucket in cdp-uploader-quarantine atlas-feedback-evidence; do
  aws_local s3api head-bucket --bucket "$bucket" 2>/dev/null || aws_local s3 mb "s3://$bucket"
done
aws_local sqs create-queue --queue-name cdp-clamav-results
aws_local sqs create-queue --queue-name cdp-uploader-scan-results-callback.fifo --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}'
aws_local sqs create-queue --queue-name cdp-uploader-download-requests
aws_local sqs create-queue --queue-name mock-clamav
aws_local s3api put-bucket-notification-configuration --bucket cdp-uploader-quarantine --notification-configuration '{"QueueConfigurations":[{"QueueArn":"arn:aws:sqs:eu-west-2:000000000000:mock-clamav","Events":["s3:ObjectCreated:*"]}]}'
touch /tmp/READY
