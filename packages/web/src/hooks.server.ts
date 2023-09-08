import ky from 'ky';

export function handle({ event, resolve }) {
  event.locals.ky = ky.extend({ fetch });

  return resolve(event);
}
