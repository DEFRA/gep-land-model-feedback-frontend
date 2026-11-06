export function getEvidenceFiles (request) {
  return request.yar.get('evidenceFiles') ?? []
}

export function getIssueAnswers (request) {
  const issueType = request.yar.get('issueType')
  const answers = {
    issueType,
    description: request.yar.get('issueDescription'),
    files: getEvidenceFiles(request)
  }
  if (issueType === 'technical') {
    return {
      ...answers,
      technicalArea: request.yar.get('technicalArea'),
      technicalOther: request.yar.get('technicalOther')
    }
  }
  const dataset = request.yar.get('dataset')
  if (dataset === 'other') {
    return {
      ...answers,
      dataset,
      datasetOtherId: request.yar.get('datasetOtherId'),
      datasetOtherTitle: request.yar.get('datasetOtherTitle'),
      issueWhere: request.yar.get('issueWhere')
    }
  }
  return {
    ...answers,
    dataset,
    location: request.yar.get('issueLocation'),
    attributes: request.yar.get('incorrectAttributes')
  }
}
