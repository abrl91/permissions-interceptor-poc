import { Permission } from 'accesscontrol';
import * as abacUtil from "./auth/abac.util";
import { ForbiddenException } from "./errors";

export function throwForbiddenExceptionByPermissions(
    invalidAttributes: any[], 
    userRoles: string[], 
    resource: string, 
    action: string,
) {

    const properties = buildInvalidAttributesForException(invalidAttributes)
    const roles = buildRolesForException(userRoles);
    throw new ForbiddenException(
        `${action} properties: ${properties} on ${resource} is forbidden for roles: ${roles}`
    );
}

function buildInvalidAttributesForException(invalidAttributes: string[]) {
    return invalidAttributes
    .map((attribute: string) => JSON.stringify(attribute))
    .join(", ");
}

function buildRolesForException(userRoles: string[]) {
    return userRoles
    .map((role: string) => JSON.stringify(role))
    .join(",");
}

export function setInvalidAttributes(
    mainCtrlName: string, 
    resource: string,
    permission: Permission,
    data?: object, // request body of rest or data.args of gql
    resourceResults?: any, // the results we send to the user in the end
    ) {
    if (mainCtrlName !== resource) {
        console.log('nested');
        
        return abacUtil.getInvalidAttributes(permission, {
            [resource.toLowerCase()]: data
        });            
    }

    console.log('not nested');
    
    return abacUtil.getInvalidAttributes(permission, resourceResults || data);
}

// export function throwForbiddenExceptionByIsRelation (
//     invalidAttributes: any[], 
//     userRoles: string[], 
//     resource: string, 
//     action: string,
//     isRelation: boolean) {
//     if (isRelation) {
//         const roles = buildRolesForException(userRoles);
//         throw new ForbiddenException(
//             `updating the relationship: ${
//                 invalidAttributes[0]
//             } of ${resource} is forbidden for roles: ${roles}`
//         );
//     } else {
//         const properties = buildInvalidAttributesForException(invalidAttributes)
//         const roles = buildRolesForException(userRoles);
//         throw new ForbiddenException(
//             `providing the properties: ${properties} on ${resource} ${action} is forbidden 
//                 for roles: ${roles}`
//         );
//     }
// }