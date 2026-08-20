          variables: {
            // {{1}} = اسم المدرسة — التطبيع (إزالة بادئة "مدرسة") يتم مركزياً في /api/send-whatsapp
            '1': schoolName || 'مدرستكم',
            '2': g.phone.replace(/^968/, ''),
          },
