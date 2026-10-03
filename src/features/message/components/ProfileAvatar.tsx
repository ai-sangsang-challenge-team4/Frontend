import defaultProfileImage from '../../../shared/assets/profile.png';

type ProfileAvatarProps = {
  className?: string;
};

export function ProfileAvatar({
  className = 'board-avatar',
}: ProfileAvatarProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      src={defaultProfileImage}
    />
  );
}
