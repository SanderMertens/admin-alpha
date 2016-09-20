/* $CORTO_GENERATED
 *
 * server.c
 *
 * Only code written between the begin and end tags will be preserved
 * when the file is regenerated.
 */

#include <corto/admin/admin.h>

corto_int16 _admin_server_construct(
    admin_server this)
{
/* $begin(corto/admin/server/construct) */
    corto_string path;

    corto_trace("admin: starting REST service", this->port);

    /* Serve up data */
    this->api = server_RESTCreate(this->port, "api", "/");
    if (!this->api) {
        goto error;
    }


    /* Serve up static file content */
    path = corto_envparse("$CORTO_TARGET/etc/corto/%s.%s/corto/admin",
        CORTO_VERSION_MAJOR,
        CORTO_VERSION_MINOR);

    corto_trace("admin: starting content service (path = '%s')", path);

    this->content = server_FilesCreate(this->port, "admin", path);
    if (!this->content) {
        goto error;
    }
    corto_dealloc(path);

    corto_ok("admin: operational on port %d", this->port);

    return 0;
error:
    return -1;
/* $end */
}
