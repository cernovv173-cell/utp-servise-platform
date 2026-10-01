import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";

const records = [
  { id: "first", name: "First item", status: "Available", quantity: 12 },
  { id: "second", name: "Second item", status: "Pending", quantity: 8 },
  { id: "third", name: "Third item", status: "Available", quantity: 4 },
];

export const TableExample = () => (
  <Table className="min-w-96">
    <TableCaption>Example records stored locally for this demonstration.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Quantity</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {records.map((record) => (
        <TableRow key={record.id}>
          <TableHead scope="row">{record.name}</TableHead>
          <TableCell>{record.status}</TableCell>
          <TableCell className="text-right tabular-nums">{record.quantity}</TableCell>
        </TableRow>
      ))}
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableHead scope="row" colSpan={2}>
          Total
        </TableHead>
        <TableCell className="text-right tabular-nums">
          {records.reduce((sum, record) => sum + record.quantity, 0)}
        </TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
