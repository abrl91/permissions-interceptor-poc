import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { InjectRolesBuilder, Permission, RolesBuilder } from 'nest-access-control';
import { Reflector } from '@nestjs/core';
import { setInvalidAttributes, throwForbiddenExceptionByPermissions } from "src/buildExceptionError";

@Injectable()
export class RestPermissionsInterceptor<T> implements NestInterceptor {
    constructor(
        @InjectRolesBuilder() private readonly rolesBuilder: RolesBuilder, 
        private readonly reflector: Reflector
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
    
        const { body } = context.switchToHttp().getRequest();
        const mainCtrlName = context.getClass().name.split(/(?=[A-Z])/)[0];        
        
        return next.handle().pipe(
            map((data) => {
                return this.mapPermissionsByAction(
                    mainCtrlName,
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
        mainCtrlName: string,
        reqBody: object,
        action: string, 
        resource: string, 
        userRoles: string[], 
        permission: Permission, 
        resourceResults: any): any[] | any | void  {
        let invalidAttributes;

        if (action === 'read') {
            console.log('read');

            if (Array.isArray(resourceResults)) {
                return resourceResults.map((results: any) => permission.filter(results))    
            } else {
               return permission.filter(resourceResults);
            }
        }

        console.log(action, 'create/update/delete');

                invalidAttributes = setInvalidAttributes(
                    mainCtrlName,
                    resource,
                    permission,
                    reqBody,
                    resourceResults
                );
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
