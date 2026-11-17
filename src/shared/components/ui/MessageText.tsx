import { Fragment } from 'react';
import { messageTextSegments } from './messageTextSegments';

export function MessageText({ children }: { children: string }) {
  return messageTextSegments(children).map((segment, index) => (
    <Fragment key={index}>{index > 0 ? <wbr /> : null}{segment}</Fragment>
  ));
}
