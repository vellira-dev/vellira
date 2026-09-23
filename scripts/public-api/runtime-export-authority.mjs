export const runtimeExportExpectationPattern =
  /expect\(Object\.keys\(api\)\.sort\(\)\)\.toEqual\(\[\n([\s\S]*?) {4}\]\);/;

export function parseRuntimeExportExpectation(content, sourceLabel) {
  const match = runtimeExportExpectationPattern.exec(content);

  if (!match) {
    throw new Error(
      `Unable to locate runtime export expectation in ${sourceLabel}`
    );
  }

  const entries = [...match[1].matchAll(/ {6}'([^']+)',/g)].map(
    (entry) => entry[1]
  );

  if (entries.length === 0) {
    throw new Error(
      `Runtime export expectation is empty or invalid in ${sourceLabel}`
    );
  }

  return entries;
}
