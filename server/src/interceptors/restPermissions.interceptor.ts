import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import * as abacUtil from "../auth/abac.util";
import * as errors from "../errors";
import { ForbiddenException } from "../errors";
import { IS_PUBLIC_KEY } from "src/decorators/public.decorator";

@Injectable()
export class RestPermissionsInterceptor<T> implements NestInterceptor {
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
    
        const { route, body } = context.switchToHttp().getRequest();
        
        return next.handle().pipe(
            map((data) => {
                return this.mapPermissionsByAction(
                    route.path,
                    body,
                    permissionsRoles.action,
                    permissionsRoles.resource,
                    permissionsRoles.role,
                    permission,
                    data
                )
            })
        )      
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
        reqBody: object,
        action: string, 
        resource: string, 
        userRoles: string[], 
        permission: Permission, 
        resourceResults: any): any[] | any | void  {
        let invalidAttributes;
        
        switch (action) {
            case 'read':
                console.log('read');
                if (Array.isArray(resourceResults)) {
                    return resourceResults.map((results: T) => permission.filter(results))    
                } else {
                   return permission.filter(resourceResults);
                }
            case 'create':
                console.log('create');
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
                console.log('update');
                    if (!this.checkRequestUrlNested(url)) {
                        console.log('simple update');
                        invalidAttributes = abacUtil.getInvalidAttributes(permission, resourceResults);
                        console.log('i dont have id in my url');
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
                    } else {
                        console.log('nested update');                        
                        invalidAttributes = abacUtil.getInvalidAttributes(
                            permission, {
                                [resource.toLowerCase()]: reqBody,
                            });
                        if (invalidAttributes.length) {
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
                console.log('delete');
                
                if (this.checkRequestUrlNested(url)) {
                    console.log('nested delete');
                    invalidAttributes = abacUtil.getInvalidAttributes(
                        permission, {
                            [resource.toLowerCase()]: reqBody
                        });
                    if (invalidAttributes.length) {
                        const roles = userRoles
                            .map((role: string) => JSON.stringify(role))
                            .join(",");
                        throw new ForbiddenException(
                            `Updating the relationship: ${
                                invalidAttributes[0]
                            } of ${resource} is forbidden for roles: ${roles}`
                        );
                    }
                } else {
                    console.log('simple delete');

                }
            default:
                console.log('no action');
                
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
