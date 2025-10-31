export function removeTrailingUnderscore(str: string) {
    if (str.endsWith("_")) {
        return str.slice(0, -1); // removes the last character of the string
    }
    return str;
}