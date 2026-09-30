import { useLocalSearchParams } from 'expo-router';

import { PageReader } from '@/reader/page-reader';

/** The Page reader at a printed page number, e.g. hafizquran://401. */
export default function PageRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <PageReader printedPage={Number(page)} />;
}
