/* eslint-disable max-lines */
import {
  extractIdentifier,
  forEachAddressOf,
  isAssignmentOperator,
} from "../extractors/extractors";
import { DereferenceAssignment } from "../types";

function identifierAfterDeref(source: string, pos: number): string {
  return extractIdentifier(source, pos + 1);
}

function transformAddressOf(source: string): string {
  let result = "";
  let lastEnd = 0;

  forEachAddressOf(source, (varName, isMut, position, varEnd) => {
    result += source.substring(lastEnd, position);
    if (isMut) {
      result += `{get:()=>${varName},set:(v)=>{${varName}=v}}`;
    } else {
      result += `{get:()=>${varName}}`;
    }
    lastEnd = varEnd;
  });

  result += source.substring(lastEnd);
  return result;
}

function findDereferenceAssignments(source: string): DereferenceAssignment[] {
  const assignments: DereferenceAssignment[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      const varName = identifierAfterDeref(source, i);
      if (varName !== "") {
        const afterVar = i + 1 + varName.length;
        if (isAssignmentOperator(source, afterVar)) {
          let exprEnd = afterVar + 3;
          while (exprEnd < source.length && source[exprEnd] !== ";") {
            exprEnd++;
          }
          assignments.push({
            varName,
            position: i,
            exprStart: afterVar + 3,
            exprEnd,
          });
        }
      }
    }
    i++;
  }
  return assignments;
}

function transformDereference(source: string): string {
  let result = "";
  let lastEnd = 0;
  const assignments = findDereferenceAssignments(source);
  const assignmentSet = new Set(assignments.map((a) => a.position));

  let i = 0;
  while (i < source.length) {
    if (source[i] === "*") {
      result += source.substring(lastEnd, i);
      if (assignmentSet.has(i)) {
        const assignment = assignments.find((a) => a.position === i)!;
        result += `${assignment.varName}.set(${source.substring(assignment.exprStart, assignment.exprEnd)})`;
        lastEnd = assignment.exprEnd;
        i = assignment.exprEnd;
      } else {
        const varName = identifierAfterDeref(source, i);
        if (varName !== "") {
          result += `${varName}.get()`;
          lastEnd = i + 1 + varName.length;
          i = lastEnd;
        } else {
          result += source[i];
          lastEnd = i + 1;
          i++;
        }
      }
    } else {
      i++;
    }
  }
  result += source.substring(lastEnd);
  return result;
}

export { transformAddressOf, transformDereference };
