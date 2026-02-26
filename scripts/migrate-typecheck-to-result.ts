/**
 * Automated migration script: typecheck_impl.tuff panic → Result<I32, TypeError>
 * Transforms typechecker functions from panic-based to Result-based error handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TYPECHECK_FILE = path.join(__dirname, '../src/main/tuff/selfhost/internal/typecheck_impl.tuff');
const BACKUP_FILE = TYPECHECK_FILE + '.backup3';

function migrate() {
    let source = fs.readFileSync(TYPECHECK_FILE, 'utf-8');
    
    // Backup original
    fs.writeFileSync(BACKUP_FILE, source, 'utf-8');
    console.log(`✓ Backed up to ${path.basename(BACKUP_FILE)}`);

    // Step 1: Update function signatures from `: I32 =>` to `: Result<I32, TypeError> =>`
    // Match functions that likely call tc_panic_loc (type*, check*, validate*, etc.)
    source = source.replace(
        /^(fn (typecheck_expr|typecheck_stmt|typecheck_|check_|validate_|verify_)[a-z_]*\([^)]*\)) : I32 =>/gm,
        '$1 : Result<I32, TypeError> =>'
    );

    // Step 2: Convert direct tc_panic_loc calls to returns with ?
    // Pattern: tc_panic_loc(...); → return tc_panic_loc(...)?;
    source = source.replace(
        /(\s+)tc_panic_loc\(/g,
        '$1return tc_panic_loc('
    );

    // Step 3: Wrap bare return values with Ok
    // Pattern: return 0; → return Ok<I32> { value: 0 };
    source = source.replace(
        /return (\d+);/g,
        'return Ok<I32> { value: $1 };'
    );

    // Pattern: return <identifier>; → return Ok<I32> { value: <identifier> };
    source = source.replace(
        /return ([a-z_][a-z0-9_]*);/g,
        'return Ok<I32> { value: $1 };'
    );

    // Step 4: Add ? operator to Result-returning function calls
    // Pattern: typecheck_expr(...); → typecheck_expr(...)?;
    source = source.replace(
        /(\s+)(typecheck_expr|typecheck_stmt|check_[a-z_]+|validate_[a-z_]+)\(/g,
        (match, indent, funcName) => {
            // Don't add ? if it's already there or if it's in a return statement
            return `${indent}${funcName}(`;
        }
    );

    // More specific: add ? to statement-position calls
    source = source.replace(
        /(\s+)(typecheck_expr|typecheck_stmt)\(([^;]+)\);/g,
        '$1$2($3)?;'
    );

    // Step 5: Fix "return Ok { value: funcName() }" → "return funcName()"
    // When function already returns Result, don't wrap
    source = source.replace(
        /return Ok<I32> \{ value: (typecheck_expr|typecheck_stmt|check_[a-z_]+|validate_[a-z_]+)\(([^}]+)\) \};/g,
        'return $1($2);'
    );

    // Step 6: Fix "return Ok { value: 0 }?;" → "return Ok { value: 0 };"
    source = source.replace(
        /return Ok<I32> \{ value: ([^}]+) \}\?;/g,
        'return Ok<I32> { value: $1 };'
    );

    // Step 7: Ensure final returns in functions are wrapped
    source = source.replace(
        /^(\s+)([a-z_][a-z0-9_]*)(\s*)$/gm,
        (match, indent, ident, trailing) => {
            // Heuristic: if it's indented and looks like an identifier at end of block
            if (indent.length >= 4 && !/^(if|else|while|let|fn|struct|type|out)$/.test(ident)) {
                return `${indent}Ok<I32> { value: ${ident} }${trailing}`;
            }
            return match;
        }
    );

    fs.writeFileSync(TYPECHECK_FILE, source, 'utf-8');
    console.log('✓ Applied typecheck migration transformations');
    console.log('  - Updated function signatures to return Result');
    console.log('  - Converted tc_panic_loc calls to returns');
    console.log('  - Wrapped success returns with Ok');
    console.log('  - Added ? operators for error propagation');
    console.log('  - Fixed Result-returning function calls');
}

try {
    migrate();
    console.log('\n✅ Migration complete! Review typecheck_impl.tuff for any manual fixes needed.');
} catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}
