const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../public/newmap.json');

try {
    console.log(`Reading ${targetPath}...`);
    const content = fs.readFileSync(targetPath, 'utf8');
    const data = JSON.parse(content);
    
    // First, stringify with standard pretty print to ensure consistent base
    const pretty = JSON.stringify(data, null, 2);
    
    // Regex to collapse string arrays (matches ["...", "..."])
    // We target the innermost arrays which contain only strings.
    // [ \n "..." , \n "..." \n ]
    
    const collapsed = pretty.replace(/\[\s+((?:"[^"]*",?\s*)+)\s+\]/g, (match, inner) => {
        // inner contains the list of strings with newlines and indentation
        // Remove newlines and excess whitespace
        const cleaned = inner.replace(/\s+/g, ' ').trim();
        // Be careful: spaces inside quotes should be preserved?
        // Wait, \s matches spaces inside quotes? "..."
        // The regex `(?:"[^"]*",?\s*)+` matches the strings.
        // We capture the whole block of strings.
        // If I simply remove newlines from the block?
        
        // Safer approach: Split by double quote?
        // Actually, since I control the input (JSON.stringify output), I know it formats as:
        // "string",
        // "string"
        
        // Let's just recombine.
        // Split by `,\n` or similar logic?
        
        // Let's re-parse the inner content? No, it's not valid JSON yet (comma separated).
        // Let's manually reconstruct.
        // Remove all newlines and indentation, keep commas.
        // And ensure a space after comma.
        
        // But what if the string contains a comma? "a,b".
        // "a,b", "c" -> replace(/\s+/g, ' ') -> "a,b", "c" (space is safe).
        
        // What if string contains newline? JSON.stringify escapes it as \n.
        // So actual newlines in the file are formatting only.
        // So global replace of \s+\n\s+ with ' ' is safe outside of strings?
        // But regex match captures the whole interior.
        // So standard replace(/\s+/g, ' ') replaces ALL whitespace sequence with single space.
        // This includes spaces inside the strings?
        // YES. "foo bar" -> "foo bar".
        // "foo  bar" -> "foo bar". (Collapses spaces).
        // If maps have "..." it's fine.
        // Do any map tiles have double spaces?
        // Names: "brick-wall..."
        // Should be fine.
        
        const singleLine = inner.replace(/\s*\n\s*/g, ' ').trim();
        return `[ ${singleLine} ]`;
    });

    console.log("Writing formatted JSON...");
    fs.writeFileSync(targetPath, collapsed);
    console.log("Done.");

} catch (err) {
    console.error("Error formatting JSON:", err);
}
