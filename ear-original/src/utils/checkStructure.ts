export const checkStructure = (content: any) => {
  let isValid = true
  if (!content?.title) isValid = false


  return isValid
}


