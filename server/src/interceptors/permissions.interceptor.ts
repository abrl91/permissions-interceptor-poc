import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import * as abacUtil from "../auth/abac.util";
import * as errors from "../errors";
import * as apollo from "apollo-server-express";
import { ForbiddenException } from "../errors";
import { IS_PUBLIC_KEY } from "src/decorators/public.decorator";


// export interface Response<T> {
//     data: T;
// }

@Injectable()
export class PermissionsInterceptor<T> implements NestInterceptor {
    constructor(
        @InjectRolesBuilder() private readonly rolesBuilder: RolesBuilder, 
        private readonly reflector: Reflector
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const isPublic = this.reflector.get<boolean>(
            IS_PUBLIC_KEY,
            context.getHandler()
        );

        if (isPublic) {
            return next.handle();
        }

        const [permissionsRoles]: any = this.reflector.getAllAndMerge<string[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        const permission = this.rolesBuilder.permission({
            role: permissionsRoles.role,
            action: permissionsRoles.action,
            possession: permissionsRoles.possession,
            resource: permissionsRoles.resource,
        });

        const type: string = context.getType();
        
        if (type === 'graphql') {
            const { path } = context.getArgByIndex(3);
            const argsData = context.getArgByIndex(1);
            
            return next.handle().pipe(
                map((data) => {
                    return this.mapPermissionsByTypeName(
                        path.typename,
                        permissionsRoles.action,
                        permissionsRoles.resource,
                        permissionsRoles.role,
                        permission,
                        argsData,
                        data,
                    )
                })
            )
        }

        if (type === 'http') {
            const { route } = context.switchToHttp().getRequest();
            return next.handle().pipe(
                map((data) => {
                    return this.mapPermissionsByAction(
                        route.path,
                        permissionsRoles.action,
                        permissionsRoles.resource,
                        permissionsRoles.role,
                        permission,
                        data
                    )
                })
            )
        }

        return next.handle();
        
        
    }

    /**
     * @param url: string, the rout path
     * @param action: string, crud operation (create/read/update/delete)
     * @param resource: string, the entity
     * @param userRoles: string[], array of the user roles (string)
     * @param permission: Permission the permissions by resource and role
     * @param resourceResults: any (depends on the resource), the return value from the route handler
     * @returns resourceResults[] (find many) | resourceResult (find one) | void (delete operations return void)
     */
    private mapPermissionsByAction(
        url: string,
        action: string, 
        resource: string, 
        userRoles: string[], 
        permission: Permission, 
        resourceResults: any): any[] | any | void  {
        let invalidAttributes;
        console.log({resourceResults}, 'no filter');
        switch (action) {
            case 'read':
                if (Array.isArray(resourceResults)) {
                    console.log(resourceResults.map((results: T) => permission.filter(results)), 'find many filtered');
                    return resourceResults.map((results: T) => permission.filter(results))    
                } else {
                    console.log(permission.filter(resourceResults), 'find one filtered');
                   return permission.filter(resourceResults);
                }
            case 'crete':
                invalidAttributes = abacUtil.getInvalidAttributes(permission, resourceResults);
                if (invalidAttributes.length) {
                    const properties = invalidAttributes
                        .map((attribute: string) => JSON.stringify(attribute))
                        .join(", ");
                    const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                    throw new errors.ForbiddenException(
                        `providing the properties: ${properties} on ${resource} ${action} is forbidden for roles: ${roles}`
                    );
                }
                return resourceResults;
            case 'update':
                invalidAttributes = abacUtil.getInvalidAttributes(permission, resourceResults);
                if (invalidAttributes.length) {
                    if (!this.checkRequestUrlNested(url)) {
                        const properties = invalidAttributes
                            .map((attribute: string) => JSON.stringify(attribute))
                            .join(", ");
                        const roles = userRoles
                            .map((role: string) => JSON.stringify(role))
                            .join(",");
                        throw new errors.ForbiddenException(
                            `providing the properties: ${properties} on ${resource} ${action} is forbidden for roles: ${roles}`
                        );
                    } else {
                        const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                      throw new ForbiddenException(
                        `Updating the relationship: ${
                          invalidAttributes[0]
                        } of ${resource} is forbidden for roles: ${roles}`
                      );
                    }
                }
                return resourceResults;
            case 'delete':
                invalidAttributes = abacUtil.getInvalidAttributes(permission, resourceResults);
                console.log('will get here if simple delete');
                if (invalidAttributes.length && this.checkRequestUrlNested(url)) {
                    console.log('will get here if nested delete');
                    const roles = userRoles
                        .map((role: string) => JSON.stringify(role))
                        .join(",");
                    throw new ForbiddenException(
                        `Updating the relationship: ${
                            invalidAttributes[0]
                        } of ${resource} is forbidden for roles: ${roles}`
                    );
                }
        }
    }

    /**
     * 
     * @param typeName string: Query/Mutation
     * @param action string: create/read/update/delete
     * @param resource string: the entity for the action
     * @param userRoles string[] roles of the loggedIn user
     * @param permission Permission of the user
     * @param args object with the data of the gql query/mutation that have sent
     * @param resourceResults any (depends on the resource), the return value from gql typename
     * @returns resourceResults[] (find many) | resourceResult (find one) | null (delete)
     */
    private mapPermissionsByTypeName(
        typeName: string,
        action: string,
        resource: string,
        userRoles: string[], 
        permission: Permission, 
        args: {data: any},
        resourceResults: any
    ): any[] | any | null {
        switch (typeName) {
            case 'Query':
                if (Array.isArray(resourceResults)) {
                    console.log(resourceResults.map((results: T) => permission.filter(results)), 'find many filtered');
                    return resourceResults.map((results: T) => permission.filter(results))    
                } else {
                    console.log(permission.filter(resourceResults), 'find one filtered');
                   return permission.filter(resourceResults);
                }
            case 'Mutation':                
                if (action === 'delete') {
                    return resourceResults;
                }
                const invalidAttributes = abacUtil.getInvalidAttributes(
                    permission,
                    args.data
                  );
                if (invalidAttributes.length) {
                    console.log('i am here');
                    
                    const properties = invalidAttributes
                      .map((attribute: string) => JSON.stringify(attribute))
                      .join(", ");
                    const roles = userRoles
                      .map((role: string) => JSON.stringify(role))
                      .join(",");
                    throw new apollo.ApolloError(
                      `providing the properties: ${properties} on ${resource} is forbidden for roles: ${roles}`
                    );
                  }
                  return resourceResults;
        }
    }

    /**
     * 
     * @param url string
     * check if url contains /:id/
     * if so - we need to handle the invalid attributed differently
     */
    private checkRequestUrlNested(url: string): boolean {
        return !!url.match('\/:id\/');
    }
  }
