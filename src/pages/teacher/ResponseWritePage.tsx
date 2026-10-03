import { useParams } from 'react-router-dom';
import { TeacherMessages } from '../../features/message';

export function ResponseWritePage() {
  const { messageId } = useParams();

  return <TeacherMessages initialThreadId={messageId} initialView="reply" />;
}
