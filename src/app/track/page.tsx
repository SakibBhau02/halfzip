import TrackClient from "@/components/TrackClient";

export const metadata = {
  title: "অর্ডার ট্র্যাক করুন — Half Zipper",
  description: "আপনার অর্ডার নম্বর ও মোবাইল দিয়ে ডেলিভারি স্ট্যাটাস দেখুন।",
};

export default function TrackPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  return <TrackClient initialOrder={searchParams.order ?? ""} />;
}
