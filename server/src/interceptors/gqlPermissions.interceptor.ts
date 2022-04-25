import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import * as abacUtil from "../auth/abac.util";
import * as apollo from "apollo-server-express";
import { IS_PUBLIC_KEY } from "src/decorators/public.decorator";
import { setInvalidAttributes, throwForbiddenExceptionByPermissions } from "src/buildExceptionError";

@Injectable()
export class GqlPermissionsInterceptor<T> implements NestInterceptor {
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
        
        const { path } = context.getArgByIndex(3);
        const argsData = context.getArgByIndex(1);
        const mainResolverName = context.getClass().name.split(/(?=[A-Z])/)[0];
        
        
        return next.handle().pipe(
            map((data) => {
                return this.mapPermissionsByTypeName(
                    mainResolverName,
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
        mainResolverName: string,
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
                console.log('Query');
                
                if (Array.isArray(resourceResults)) {
                    return resourceResults.map((results: T) => permission.filter(results))    
                } else {
                   return permission.filter(resourceResults);
                }
            case 'Mutation':
                console.log('Mutation');
                             
                const invalidAttributes = setInvalidAttributes(
                    mainResolverName,
                    resource,
                    permission,
                    args,
                ) || [];
                if (invalidAttributes.length) {
                    throwForbiddenExceptionByPermissions(
                        invalidAttributes,
                        userRoles,
                        resource,
                        action
                    );
                }
                return resourceResults;
        }
    }
  }
