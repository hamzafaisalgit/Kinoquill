import { LibraryExplorer } from "../components/library/LibraryExplorer";
import { ArchivedCollection } from "../components/library/ArchivedCollection";
export default function ShowsPage() {
  return (
    <>
      <LibraryExplorer scope="shows" />
      <ArchivedCollection mediaType="tv" />
    </>
  );
}
