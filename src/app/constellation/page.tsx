import { Suspense } from 'react';
import { ConstellationClient } from './ConstellationClient';

export default function ConstellationPage() {
  return (
    <Suspense>
      <ConstellationClient />
    </Suspense>
  );
}
