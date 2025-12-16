const Order = require("../../models/ordersSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const { ChartJSNodeCanvas } = require("chartjs-node-canvas");


// Helper: get date range based on type
function getDateRange(type, startDate, endDate) {
  const now = new Date();
  let start, end;

  switch (type) {
    case "daily":
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;

    case "weekly": {
      const clone = new Date();
      const day = clone.getDay(); // 0-6
      const diffToMonday = (day + 6) % 7;
      start = new Date(clone);
      start.setDate(clone.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }

    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "yearly":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;

    case "custom":
      start = new Date(startDate);
      end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
  }

  return { start, end };
}

// =======================================
// 1) JSON DATA FOR DASHBOARD (AJAX)
// =======================================
  const getReportData = async (req, res) => {
  try {
    let { type = "daily", startDate, endDate } = req.query;

    const { start, end } = getDateRange(type, startDate, endDate);

    // Ignore cancelled / returned / failed orders
    const match = {
      createdOn: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "Returned", "Payment Failed"] }
    };

    // ----- SUMMARY -----
    const summaryAgg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          grossAmount: { $sum: "$totalPrice" },
         totalDiscount: { $sum: "$discount" },

          // Coupon discount = discount applied only when couponCode exists
          couponDiscount: {
            $sum: {
              $cond: [
                { $ifNull: ["$couponCode", false] },   // coupon was used
                "$discount",                           // treat discount as coupon discount
                0
              ]
            }
          },

          netAmount: { $sum: "$finalAmount" }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      totalOrders: 0,
      grossAmount: 0,
      totalDiscount: 0,
      couponDiscount: 0,
      netAmount: 0
    };

    // ----- SALES TREND (LINE) -----
    const salesTrend = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
          },
          netSales: { $sum: "$finalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    
    // ----- TOP PRODUCTS (BAR) -----
    const topProducts = await Order.aggregate([
      { $match: match },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          revenue: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          name: "$product.productName",
          revenue: 1
        }
      }
    ]);

    // ----- TOP CATEGORIES (BAR) -----
    const topCategories = await Order.aggregate([
      { $match: match },
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category._id",
          name: { $first: "$category.name" },
          revenue: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          name: 1,
          revenue: 1
        }
      }
    ]);

    // ----- ORDERS TABLE -----
    const orders = await Order.find(match)
      .populate("userId", "name email")
      .sort({ createdOn: -1 })
      .lean();

    res.json({
      success: true,
      summary,
      salesTrend,
      topProducts,
      topCategories,
      orders
    });

  } catch (err) {
    console.error("Sales report error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// =======================================
// 2) DOWNLOAD PDF
// =======================================

const downloadPDF = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const { start, end } = getDateRange(type, startDate, endDate);

    const match = {
      createdOn: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "Returned", "Payment Failed"] }
    };

    const orders = await Order.find(match)
      .populate("userId", "name email")
      .sort({ createdOn: -1 })
      .lean();

    const summaryAgg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          grossAmount: { $sum: "$totalPrice" },
          totalDiscount: { $sum: "$discount" },
          couponDiscount: { $sum: "$couponDiscount" },
          netAmount: { $sum: "$finalAmount" }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      totalOrders: 0,
      grossAmount: 0,
      totalDiscount: 0,
      couponDiscount: 0,
      netAmount: 0
    };

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.pdf"
    );

    doc.pipe(res);

    /* ================= HEADER ================= */
    doc.fontSize(20).text("Sales Report", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(10).text(
      `Period: ${type.toUpperCase()} | ${start.toDateString()} - ${end.toDateString()}`,
      { align: "center" }
    );

    doc.moveDown(1.5);

    /* ================= SUMMARY ================= */
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Total Orders     : ${summary.totalOrders}`);
    doc.text(`Gross Amount     : ₹${summary.grossAmount.toFixed(2)}`);
    doc.text(`Total Discount   : ₹${summary.totalDiscount.toFixed(2)}`);
    doc.text(`Coupon Discount  : ₹${summary.couponDiscount.toFixed(2)}`);
    doc.text(`Net Amount       : ₹${summary.netAmount.toFixed(2)}`);

    doc.moveDown(1.5);

    /* ================= TABLE ================= */
    const tableTop = doc.y;
    const pageWidth = doc.page.width - 80;

    const col = {
      order: 40,
      user: 120,
      amount: 260,
      status: 330,
      date: 430
    };

    const drawTableHeader = () => {
      doc.fontSize(11).font("Helvetica-Bold");
      doc.text("Order ID", col.order, doc.y);
      doc.text("Customer", col.user, doc.y);
      doc.text("Amount", col.amount, doc.y);
      doc.text("Status", col.status, doc.y);
      doc.text("Date", col.date, doc.y);
      doc.moveDown(0.4);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica");
    };

    drawTableHeader();

    orders.forEach((o) => {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        drawTableHeader();
      }

      doc.fontSize(10);
      doc.text(`#${o.orderId}`, col.order, doc.y);
      doc.text(o.userId ? o.userId.name : "Guest", col.user, doc.y, {
        width: 120
      });
      doc.text(`₹${o.finalAmount.toFixed(2)}`, col.amount, doc.y);
      doc.text(o.status, col.status, doc.y);
      doc.text(o.createdOn.toDateString(), col.date, doc.y);

      doc.moveDown(0.5);
    });

    doc.end();
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).send("Error generating PDF");
  }
};

// =======================================
// 3) DOWNLOAD EXCEL
// =======================================
const downloadExcel = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    const { start, end } = getDateRange(type, startDate, endDate);

    const match = {
      createdOn: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "Returned", "Payment Failed"] }
    };

    const orders = await Order.find(match)
      .populate("userId", "name email")
      .sort({ createdOn: -1 })
      .lean();

    // 🎉 Excel now contains ONLY filtered results


    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Order ID", key: "orderId", width: 25 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Total Price", key: "totalPrice", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Coupon Discount", key: "couponDiscount", width: 18 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Date", key: "date", width: 20 }
    ];

    orders.forEach((o) => {
      sheet.addRow({
        orderId: o.orderId,
        customer: o.userId ? o.userId.name : "Guest",
        email: o.userId ? o.userId.email : "",
        totalPrice: o.totalPrice,
        discount: o.discount,
        couponDiscount: o.couponDiscount || 0,
        finalAmount: o.finalAmount,
        status: o.status,
        date: o.createdOn.toDateString()
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel error:", err);
    res.status(500).send("Error generating Excel");
  }
};


const generateChartImage = async (labels, values, type = "line") => {
  const width = 800;
  const height = 400;

  const chartCallback = (ChartJS) => {
    ChartJS.defaults.color = "#000";   // black text
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    chartCallback
  });

  const configuration = {
    type,
    data: {
      labels,
      datasets: [
        {
          label: "Sales Amount",
          data: values,
          fill: false,
          borderColor: "#008cba",
          backgroundColor: "rgba(0, 140, 186, 0.4)",
          tension: 0.3
        }
      ]
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
};

module.exports={
     getReportData,
     downloadPDF,
     downloadExcel ,
     

}

