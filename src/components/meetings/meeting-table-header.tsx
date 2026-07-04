import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

function MeetingsTableHeader() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="pl-4">Meeting</TableHead>
        <TableHead className="w-px whitespace-nowrap">Status</TableHead>
        <TableHead className="w-px whitespace-nowrap">Duration</TableHead>
        <TableHead className="w-px whitespace-nowrap">Created</TableHead>
        <TableHead className="w-px whitespace-nowrap">Last updated</TableHead>
        <TableHead className="w-px whitespace-nowrap pr-4">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export { MeetingsTableHeader };
