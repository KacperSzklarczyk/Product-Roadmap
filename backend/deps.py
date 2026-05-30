from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from models import Member, MemberRole, User
from security import decode_access_token

# tokenUrl is relative to the app root; powers the "Authorize" button in /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

# Role hierarchy: higher rank implies all lower-rank permissions.
ROLE_RANK: dict[MemberRole, int] = {
    MemberRole.VIEWER: 1,
    MemberRole.EDITOR: 2,
    MemberRole.OWNER: 3,
}


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Resolve the authenticated user from a Bearer token."""
    subject = decode_access_token(token)
    if subject is None:
        raise _credentials_exc

    user = await User.get_or_none(id=int(subject))
    if user is None or not user.is_active:
        raise _credentials_exc
    return user


def require_role(minimum: MemberRole):
    """Dependency factory enforcing project membership + a minimum role.

    Reads `project_id` from the path. Returns the caller's Member row so routes
    can reuse it (e.g. to know the caller's role). 404 if not a member, 403 if
    the role is below `minimum`.
    """

    async def dependency(
        project_id: int, current_user: User = Depends(get_current_user)
    ) -> Member:
        member = await Member.get_or_none(
            project_id=project_id, user_id=current_user.id
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
            )
        if ROLE_RANK[member.role] < ROLE_RANK[minimum]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least '{minimum.value}' role",
            )
        return member

    return dependency
